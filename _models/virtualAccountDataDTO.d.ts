import type AdditionalInfoResponseDTO = require('./additionalInfoResponseDTO');

declare class VirtualAccountDataDTO {
  partnerServiceId: string;
  customerNo: string;
  virtualAccountNo: string;
  virtualAccountName: string;
  virtualAccountEmail: string;
  trxId: string;
  totalAmount: unknown;
  additionalInfo: AdditionalInfoResponseDTO;
  constructor(data: unknown);
  toObject(): {
    partnerServiceId: string;
    customerNo: string;
    virtualAccountNo: string;
    virtualAccountName: string;
    virtualAccountEmail: string;
    trxId: string;
    totalAmount: unknown;
    additionalInfo: AdditionalInfoResponseDTO;
  };
}

export = VirtualAccountDataDTO;
