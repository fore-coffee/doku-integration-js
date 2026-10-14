import type VirtualAccountDataDTO = require('./virtualAccountDataDTO');

declare class CreateVAResponseDTO {
  responseCode: string;
  responseMessage: string;
  virtualAccountData: VirtualAccountDataDTO;
  constructor(data: unknown);
  toObject(): {
    responseCode: string;
    responseMessage: string;
    virtualAccountData: VirtualAccountDataDTO;
  };
}

export = CreateVAResponseDTO;
