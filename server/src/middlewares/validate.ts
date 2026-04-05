import type { Request, Response, NextFunction } from 'express';

type FieldRule =
  | { type: 'string'; required?: boolean; maxLength?: number }
  | { type: 'email'; required?: boolean }
  | { type: 'enum'; values: string[]; required?: boolean };

type Schema = Record<string, FieldRule>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validate(schema: Schema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];
    const body = req.body as Record<string, unknown>;

    for (const [field, rule] of Object.entries(schema)) {
      const value = body[field];
      const missing = value === undefined || value === null || value === '';

      if (rule.required && missing) {
        errors.push(`"${field}" is required`);
        continue;
      }

      if (missing) continue;

      if (rule.type === 'string' || rule.type === 'email') {
        if (typeof value !== 'string') {
          errors.push(`"${field}" must be a string`);
          continue;
        }
        if (rule.type === 'email' && !EMAIL_RE.test(value)) {
          errors.push(`"${field}" must be a valid email`);
        }
        if (rule.type === 'string' && rule.maxLength && value.length > rule.maxLength) {
          errors.push(`"${field}" must be at most ${rule.maxLength} characters`);
        }
      }

      if (rule.type === 'enum' && !rule.values.includes(String(value))) {
        errors.push(`"${field}" must be one of: ${rule.values.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ errors });
      return;
    }

    next();
  };
}
