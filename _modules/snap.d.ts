import type CheckStatusVARequestDto = require('../_models/checkStatusVARequestDTO');
import type CheckStatusVaResponseDTO = require('../_models/checkStatusVaResponseDTO');
import type CreateVARequestDto = require('../_models/createVaRequestDto');
import type CreateVAResponseDTO = require('../_models/createVaResponseDTO');
import type TokenB2BResponseDTO = require('../_models/tokenB2BResponseDTO');

declare class Snap {
  constructor(options: {
    isProduction: boolean;
    privateKey: string;
    clientID: string;
    publicKey: string;
    dokuPublicKey: string;
    issuer: string;
    secretKey: string;
    /** Timeout (ms) of the token request. Same fallback rule as `timeoutMs` below. */
    tokenTimeoutMs?: number;
  });

  /**
   * `timeoutMs`: timeout in ms of this call's DOKU request. `undefined` or anything that is not a
   * positive finite number (0, negative, NaN, a string such as "5000") falls back to the SDK
   * default (3s); there is no "no timeout". A token refresh it triggers uses the constructor's
   * `tokenTimeoutMs`, not this value.
   */
  createVa(createVARequestDto: CreateVARequestDto, timeoutMs?: number): Promise<CreateVAResponseDTO>;
  /** See `createVa` for `timeoutMs`. */
  checkStatusVa(checkVARequestDTO: CheckStatusVARequestDto, timeoutMs?: number): Promise<CheckStatusVaResponseDTO>;
  validateSignatureAndGenerateToken(request: Snap.DokuSnapB2BAuthRequest): Snap.DokuTokenResponse;
  validateTokenB2B(requestTokenB2B: string): Record<string, unknown> | false;
  generateNotificationResponse(
    isTokenValid: boolean,
    paymentNotificationRequestBodyDto: Record<string, unknown>,
  ): Record<string, unknown>;
  getTokenB2B(): Promise<TokenB2BResponseDTO>;
}

declare namespace Snap {
  interface DokuTokenResponse {
    header?: Record<string, unknown>;
    body: Record<string, unknown>;
  }

  /**
   * Minimal shape used by `Snap.validateSignatureAndGenerateToken` (the SDK only calls
   * `request.get('x-timestamp')` / `request.get('x-signature')`).
   */
  interface DokuSnapB2BAuthRequest {
    get(name: string): string | undefined;
  }
}

export = Snap;
