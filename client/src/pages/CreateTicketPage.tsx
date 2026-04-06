import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import ProductPickerModal from '../components/ProductPickerModal';
import { useProducts } from '../hooks/useProducts';
import type { Product } from '../types/product';
import type { Attachment } from '../types/ticket';
import { useLanguage } from '../i18n/LanguageContext';
import type { translations } from '../i18n/translations';

interface FormState {
  title: string;
  description: string;
  authorName: string;
  authorEmail: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;
interface SelectedImage {
  id: string;
  file: File;
  previewUrl: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ACCEPTED_IMAGE_TYPES = new Set(['image/gif', 'image/jpeg', 'image/png', 'image/webp']);
const MAX_TICKET_IMAGE_COUNT = 5;
const MAX_TICKET_IMAGE_BYTES = 10 * 1024 * 1024;

type TCT = typeof translations.en.createTicket;

function validate(form: FormState, tc: TCT): FormErrors {
  const errors: FormErrors = {};
  if (!form.title.trim()) errors.title = tc.titleRequired;
  else if (form.title.trim().length < 3) errors.title = tc.titleTooShort;

  if (!form.description.trim()) errors.description = tc.descriptionRequired;
  else if (form.description.trim().length < 10)
    errors.description = tc.descriptionTooShort;

  if (!form.authorName.trim()) errors.authorName = tc.nameRequired;

  if (!form.authorEmail.trim()) errors.authorEmail = tc.emailRequired;
  else if (!EMAIL_RE.test(form.authorEmail)) errors.authorEmail = tc.emailInvalid;

  return errors;
}

const labelCls = 'block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5';
const inputCls = (hasError: boolean) =>
  `block w-full rounded-lg border bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 transition ${
    hasError
      ? 'border-red-500/50 focus:ring-red-500/20'
      : 'border-zinc-800 focus:border-zinc-700 focus:ring-olive-500/20'
  }`;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-red-400">{message}</p>;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type AiAskState =
  | { stage: 'idle' }
  | { stage: 'asking' }
  | { stage: 'answered'; answer: string; shouldEscalate: boolean; question: string; suggestedTitle: string; suggestedDescription: string };

export default function CreateTicketPage() {
  const { t } = useLanguage();
  const tc = t.createTicket;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { products, loading: productsLoading, error: productsError, reload: reloadProducts } = useProducts();
  const [searchParams] = useSearchParams();
  const preselectedProduct = searchParams.get('product') ?? '';

  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiAsk, setAiAsk]             = useState<AiAskState>({ stage: 'idle' });
  const [aiQuestion, setAiQuestion]   = useState('');

  const [selectedProductId, setSelectedProductId] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [submitStage, setSubmitStage] = useState<'idle' | 'uploading' | 'submitting'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedImagesRef = useRef<SelectedImage[]>([]);

  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    authorName: '',
    authorEmail: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  useEffect(() => () => {
    selectedImagesRef.current.forEach((image) => {
      URL.revokeObjectURL(image.previewUrl);
    });
  }, []);

  useEffect(() => {
    if (!preselectedProduct || selectedProductId) {
      return;
    }

    const product = products.find(
      (entry) =>
        entry._id === preselectedProduct ||
        entry.slug === preselectedProduct ||
        entry.name === preselectedProduct,
    );

    if (product) {
      setSelectedProductId(product._id);
    }
  }, [preselectedProduct, products, selectedProductId]);

  const selectedProduct =
    products.find((product) => product._id === selectedProductId) ?? null;

  function handleProductSelect(product: Product) {
    setSelectedProductId(product._id);
  }

  function removeSelectedImage(imageId: string) {
    setSelectedImages((current) => {
      const image = current.find((entry) => entry.id === imageId);
      if (image) {
        URL.revokeObjectURL(image.previewUrl);
      }
      return current.filter((entry) => entry.id !== imageId);
    });
  }

  function handleImageSelection(e: React.ChangeEvent<HTMLInputElement>) {
    const incomingFiles = Array.from(e.target.files ?? []);
    e.target.value = '';

    if (incomingFiles.length === 0) {
      return;
    }

    setImageError(null);

    setSelectedImages((current) => {
      const next = [...current];

      for (const file of incomingFiles) {
        if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
          setImageError('Only GIF, JPG, PNG, and WEBP images are allowed.');
          continue;
        }

        if (file.size > MAX_TICKET_IMAGE_BYTES) {
          setImageError(`Each image must be smaller than ${Math.round(MAX_TICKET_IMAGE_BYTES / (1024 * 1024))} MB.`);
          continue;
        }

        if (next.length >= MAX_TICKET_IMAGE_COUNT) {
          setImageError(`You can attach up to ${MAX_TICKET_IMAGE_COUNT} images per request.`);
          break;
        }

        next.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }

      return next;
    });
  }

  async function uploadImages(): Promise<Attachment[]> {
    return Promise.all(
      selectedImages.map(async ({ file }) => {
        try {
          const { data } = await api.uploads.presignTicketImage({
            fileName: file.name,
            contentType: file.type,
            size: file.size,
          });

          const uploadRes = await fetch(data.uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': file.type,
            },
            body: file,
          });

          if (!uploadRes.ok) {
            throw new Error(`Failed to upload "${file.name}"`);
          }

          return data.attachment;
        } catch (err) {
          if (err instanceof TypeError) {
            throw new Error(
              'Image upload was blocked by the storage endpoint. Check the R2 bucket CORS policy for http://localhost:3000 and allow PUT with the Content-Type header.',
            );
          }
          throw err;
        }
      }),
    );
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormState]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!aiQuestion.trim()) return;
    setAiAsk({ stage: 'asking' });
    try {
      const product = selectedProduct ? { name: selectedProduct.name, category: selectedProduct.category } : undefined;
      const { data } = await api.ai.ask(aiQuestion.trim(), product);
      setAiAsk({ stage: 'answered', answer: data.answer, shouldEscalate: data.shouldEscalate, question: aiQuestion.trim(), suggestedTitle: data.suggestedTitle, suggestedDescription: data.suggestedDescription });
    } catch {
      setAiAsk({ stage: 'idle' });
      toast('AI is temporarily unavailable — please submit a ticket directly.', 'error');
    }
  }

  function handleStillNeedSupport() {
    if (aiAsk.stage !== 'answered') return;
    setForm((prev) => ({
      ...prev,
      title:       aiAsk.suggestedTitle,
      description: aiAsk.suggestedDescription,
    }));
    setErrors({});
    setAiQuestion('');
    setAiAsk({ stage: 'idle' });
    setAiPanelOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validate(form, tc);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setSubmitStage(selectedImages.length > 0 ? 'uploading' : 'submitting');
    setApiError(null);
    setImageError(null);

    try {
      const attachments = selectedImages.length > 0 ? await uploadImages() : [];
      setSubmitStage('submitting');

      const payload = {
        ...form,
        title: form.title,
        productId:          selectedProduct?._id,
        productName:        selectedProduct?.name,
        productCategory:    selectedProduct?.category,
        productDescription: selectedProduct?.description ?? undefined,
        productPrice:       selectedProduct?.price ?? undefined,
        productImageUrl:    selectedProduct?.imageUrl ?? undefined,
        attachments,
        // priority intentionally omitted — will be set by AI triage (see ticket.controller.ts)
      };

      const { data } = await api.tickets.create(payload);
      toast('Ticket submitted successfully', 'success');
      navigate(`/support/success/${data._id}`, {
        replace: true,
        state: {
          authorEmail: form.authorEmail,
          productName: selectedProduct?.name ?? null,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setApiError(msg);
      toast(msg, 'error');
    } finally {
      setSubmitStage('idle');
    }
  }

  return (
    <>
      {pickerOpen && (
        <ProductPickerModal
          products={products}
          selectedProductId={selectedProductId}
          loading={productsLoading}
          error={productsError}
          onRetry={reloadProducts}
          onSelect={handleProductSelect}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <div className="mx-auto max-w-xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/products"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 transition hover:text-zinc-300"
          >
            {tc.backToProducts}
          </Link>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            {tc.portal}
          </p>
          <h1 className="text-2xl font-bold text-zinc-100">{tc.heading}</h1>
          <p className="mt-1 max-w-lg text-sm text-zinc-500">
            {tc.subtitle}
          </p>
        </div>

        {/* Ask AI First */}
        {aiAsk.stage === 'answered' ? (
          <div className="mb-8 rounded-xl border border-zinc-700 bg-zinc-900 p-5">
            <div className="mb-3 flex items-start gap-2">
              <span className="mt-0.5 text-olive-400">✦</span>
              <div className="flex-1">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{tc.aiAnswer}</p>
                <p className="text-xs text-zinc-500 italic">"{aiAsk.question}"</p>
              </div>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-zinc-200">{aiAsk.answer}</p>
            {aiAsk.shouldEscalate && (
              <p className="mb-4 rounded border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
                {tc.escalateWarning}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/products')}
                className="flex-1 rounded border border-emerald-500/30 bg-emerald-500/10 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 transition hover:bg-emerald-500/20"
              >
                {tc.solvedMyIssue}
              </button>
              <button
                onClick={handleStillNeedSupport}
                className="flex-1 rounded border border-zinc-700 bg-zinc-800 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 transition hover:text-zinc-200"
              >
                {tc.stillNeedSupport}
              </button>
            </div>
          </div>
        ) : !aiPanelOpen ? (
          <button
            type="button"
            onClick={() => setAiPanelOpen(true)}
            className="mb-8 flex w-full items-center justify-between rounded-xl border border-olive-500/20 bg-olive-500/5 px-5 py-3.5 text-left transition hover:border-olive-500/30 hover:bg-olive-500/8"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-olive-400">✦</span>
              <span className="text-sm font-semibold text-zinc-200">{tc.getInstantHelp}</span>
              <span className="text-xs text-zinc-600">{tc.askAiSubtitle}</span>
            </div>
            <span className="text-xs text-zinc-600">›</span>
          </button>
        ) : (
          <div className="mb-8 rounded-xl border border-olive-500/20 bg-olive-500/5 p-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-olive-400">✦</span>
              <p className="text-sm font-semibold text-zinc-200">{tc.getInstantHelp}</p>
              <button
                type="button"
                onClick={() => setAiPanelOpen(false)}
                className="ml-auto text-xs text-zinc-600 hover:text-zinc-400"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-xs text-zinc-500">{tc.askAiDescription}</p>

            {/* Inline product selector */}
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mb-3 flex w-full items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-left text-sm transition hover:border-zinc-700"
            >
              {selectedProduct ? (
                <>
                  {selectedProduct.imageUrl && (
                    <img src={selectedProduct.imageUrl} alt="" className="h-6 w-6 rounded object-cover" />
                  )}
                  <span className="flex-1 truncate text-zinc-200">{selectedProduct.name}</span>
                  <span className="text-[10px] text-zinc-600">{tc.change}</span>
                </>
              ) : (
                <>
                  <span className="flex-1 text-zinc-600">{tc.selectProductOptional}</span>
                  <span className="text-[10px] text-zinc-600">›</span>
                </>
              )}
            </button>

            <form onSubmit={(e) => void handleAsk(e)} className="flex gap-2">
              <input
                type="text"
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                placeholder={tc.askAiPlaceholder}
                disabled={aiAsk.stage === 'asking'}
                autoFocus
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-olive-500/20 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={aiAsk.stage === 'asking' || !aiQuestion.trim()}
                className="th-btn shrink-0 rounded border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition disabled:opacity-40"
              >
                {aiAsk.stage === 'asking' ? '…' : tc.askAi}
              </button>
            </form>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-6">
          {/* API error */}
          {apiError && (
            <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">
              <span className="font-bold">✕</span>
              {apiError}
            </div>
          )}

          {/* Product selector */}
          <div>
            <label className={labelCls}>{tc.productLabel} <span className="normal-case text-zinc-600">{tc.optional}</span></label>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-left text-sm transition hover:border-zinc-700"
            >
              {selectedProduct ? (
                <span className="flex items-center gap-3">
                  {selectedProduct.imageUrl ? (
                    <img
                      src={selectedProduct.imageUrl}
                      alt={selectedProduct.name}
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded bg-zinc-800 text-xs text-zinc-600">◈</span>
                  )}
                  <span className="text-zinc-100">{selectedProduct.name}</span>
                </span>
              ) : productsLoading ? (
                <span className="text-zinc-600">{tc.loadingProducts}</span>
              ) : (
                <span className="text-zinc-600">{tc.selectProductPlaceholder}</span>
              )}
              <span className="text-zinc-600">▾</span>
            </button>
            {selectedProduct && (
              <button
                type="button"
                onClick={() => setSelectedProductId('')}
                className="mt-1.5 text-xs text-zinc-600 hover:text-zinc-400"
              >
                {tc.clearSelection}
              </button>
            )}
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className={labelCls}>{tc.titleLabel}</label>
            <input
              id="title"
              name="title"
              type="text"
              value={form.title}
              onChange={handleChange}
              placeholder={tc.titlePlaceholder}
              className={inputCls(!!errors.title)}
            />
            <FieldError message={errors.title} />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className={labelCls}>{tc.descriptionLabel}</label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={5}
              placeholder={tc.descriptionPlaceholder}
              className={inputCls(!!errors.description)}
            />
            <FieldError message={errors.description} />
          </div>

          {/* Images */}
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className={labelCls}>{tc.imagesLabel} <span className="normal-case text-zinc-600">{tc.optional}</span></label>
                <p className="text-xs text-zinc-600">
                  {tc.imageHint.replace('{max}', String(MAX_TICKET_IMAGE_COUNT)).replace('{size}', String(Math.round(MAX_TICKET_IMAGE_BYTES / (1024 * 1024))))}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/gif,image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleImageSelection}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitStage !== 'idle'}
                className="shrink-0 rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {tc.addImages}
              </button>
            </div>

            {imageError && <p className="mt-2 text-xs text-red-400">{imageError}</p>}

            {selectedImages.length > 0 && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {selectedImages.map((image) => (
                  <div key={image.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                    <img
                      src={image.previewUrl}
                      alt={image.file.name}
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <div className="flex items-start justify-between gap-3 border-t border-zinc-800 px-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-zinc-200">{image.file.name}</p>
                        <p className="text-[11px] text-zinc-600">{formatBytes(image.file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSelectedImage(image.id)}
                        disabled={submitStage !== 'idle'}
                        className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 transition hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {tc.remove}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="h-px bg-zinc-800" />

          {/* Author row */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="authorName" className={labelCls}>{tc.nameLabel}</label>
              <input
                id="authorName"
                name="authorName"
                type="text"
                value={form.authorName}
                onChange={handleChange}
                placeholder="John Recon"
                className={inputCls(!!errors.authorName)}
              />
              <FieldError message={errors.authorName} />
            </div>
            <div>
              <label htmlFor="authorEmail" className={labelCls}>{tc.emailLabel}</label>
              <input
                id="authorEmail"
                name="authorEmail"
                type="email"
                value={form.authorEmail}
                onChange={handleChange}
                placeholder="john@unit.mil"
                className={inputCls(!!errors.authorEmail)}
              />
              <FieldError message={errors.authorEmail} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              to="/products"
              className="rounded border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 transition hover:text-zinc-300"
            >
              {tc.cancel}
            </Link>
            <button
              type="submit"
              disabled={submitStage !== 'idle'}
              className="th-btn rounded border px-6 py-2.5 text-xs font-semibold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitStage === 'uploading'
                ? tc.uploadingImages
                : submitStage === 'submitting'
                  ? tc.submitting
                  : tc.submitRequest}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
