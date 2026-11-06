import type React from 'react';

export function Field({ label, required, optional, hint, error, className = '', children }: { label: string; required?: boolean; optional?: boolean; hint?: string; error?: string; className?: string; children: React.ReactNode }) {
  return <label className={`field ${className}`}><span className="field-label">{label} {required && <i>Required</i>}{optional && <small>Optional</small>}</span>{children}{hint && <small className="field-hint">{hint}</small>}{error && <small className="field-error">{error}</small>}</label>;
}
