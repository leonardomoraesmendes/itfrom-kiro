import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  documentoFiscalSchema,
  type DocumentoFiscalJSON,
} from './documento-fiscal-schema';

const ajv = new Ajv({ allErrors: true, verbose: true });
addFormats(ajv);

const validate = ajv.compile(documentoFiscalSchema);

/** Describes a single field-level validation error. */
export interface FieldError {
  /** JSON pointer path to the field, e.g. "/cnpjEmitente" */
  field: string;
  /** Human-readable error message */
  message: string;
}

/** Result of `validateDocumentoFiscal`. */
export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}

/**
 * Translates an AJV error into a descriptive, field-level message in Portuguese.
 */
function formatFieldError(err: {
  instancePath: string;
  keyword: string;
  params: Record<string, unknown>;
  message?: string;
  schemaPath: string;
}): FieldError {
  const field = err.instancePath || '/';

  switch (err.keyword) {
    case 'required': {
      const missing = err.params.missingProperty as string;
      return {
        field: `${field === '/' ? '' : field}/${missing}`,
        message: `Campo obrigatório "${missing}" está ausente.`,
      };
    }
    case 'pattern': {
      const pattern = err.params.pattern as string;
      if (pattern === '^AP-\\d{8}-\\d{6}$') {
        return {
          field,
          message:
            'O campo "protocoloUnico" deve seguir o padrão AP-XXXXXXXX-XXXXXX (ex: AP-20240101-000001).',
        };
      }
      if (pattern === '^\\d{14}$') {
        return {
          field,
          message: `O campo "${fieldName(field)}" deve conter exatamente 14 dígitos numéricos (CNPJ).`,
        };
      }
      return { field, message: `Valor não corresponde ao padrão esperado: ${pattern}` };
    }
    case 'enum': {
      const allowed = (err.params.allowedValues as string[]).join(', ');
      return {
        field,
        message: `Valor inválido para "${fieldName(field)}". Valores permitidos: ${allowed}.`,
      };
    }
    case 'format': {
      return {
        field,
        message: `O campo "${fieldName(field)}" deve estar no formato de data ISO (YYYY-MM-DD).`,
      };
    }
    case 'type': {
      const expected = err.params.type as string;
      return {
        field,
        message: `O campo "${fieldName(field)}" deve ser do tipo "${expected}".`,
      };
    }
    case 'minimum': {
      const limit = err.params.limit as number;
      return {
        field,
        message: `O campo "${fieldName(field)}" deve ser maior ou igual a ${limit}.`,
      };
    }
    case 'maximum': {
      const limit = err.params.limit as number;
      return {
        field,
        message: `O campo "${fieldName(field)}" deve ser menor ou igual a ${limit}.`,
      };
    }
    case 'minLength': {
      return {
        field,
        message: `O campo "${fieldName(field)}" não pode estar vazio.`,
      };
    }
    case 'additionalProperties': {
      const extra = err.params.additionalProperty as string;
      return {
        field,
        message: `Propriedade não permitida: "${extra}".`,
      };
    }
    default:
      return {
        field,
        message: err.message ?? `Erro de validação no campo "${fieldName(field)}".`,
      };
  }
}

/** Extracts the last segment of a JSON pointer path as a readable field name. */
function fieldName(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

/**
 * Validates a JSON value against the DocumentoFiscal schema.
 *
 * Returns a `ValidationResult` with `valid: true` if the input conforms,
 * or `valid: false` with descriptive per-field error messages.
 *
 * @param json - The unknown input to validate
 * @returns ValidationResult
 */
export function validateDocumentoFiscal(json: unknown): ValidationResult {
  const valid = validate(json);

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors: FieldError[] = (validate.errors ?? []).map((err) =>
    formatFieldError(err as Parameters<typeof formatFieldError>[0]),
  );

  return { valid: false, errors };
}

/**
 * Parses and validates a JSON value, returning a typed `DocumentoFiscalJSON`.
 *
 * @param json - The unknown input to parse
 * @returns The validated DocumentoFiscalJSON object
 * @throws Error with descriptive field-level messages if validation fails
 */
export function parseDocumentoFiscal(json: unknown): DocumentoFiscalJSON {
  const result = validateDocumentoFiscal(json);

  if (!result.valid) {
    const details = result.errors
      .map((e) => `  • ${e.field}: ${e.message}`)
      .join('\n');
    throw new Error(
      `DocumentoFiscal inválido. Erros encontrados:\n${details}`,
    );
  }

  return json as DocumentoFiscalJSON;
}
