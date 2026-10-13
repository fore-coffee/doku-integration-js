declare class TokenB2BResponseDTO {
  responseCode: string;
  responseMessage: string;
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  additionalInfo: unknown;
  constructor(data: unknown);
}

export = TokenB2BResponseDTO;
