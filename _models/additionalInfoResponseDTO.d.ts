/** Create VA API response: nested DTO (not the same as check-status virtual account data). */
declare class AdditionalInfoResponseDTO {
  channel?: string;
  howToPayPage?: unknown;
  howToPayApi?: unknown;
  constructor(data: { channel?: string; howToPayPage?: unknown; howToPayApi?: unknown });
  toObject(): {
    channel?: string;
    howToPayPage?: unknown;
    howToPayApi?: unknown;
  };
}

export = AdditionalInfoResponseDTO;
