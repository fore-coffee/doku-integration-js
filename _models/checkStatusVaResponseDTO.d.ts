import type CheckStatusResponseAdditionalInfo = require('./checkStatusResponseAdditionalInfoDTO');
import type CheckStatusVirtualAccountData = require('./checkStatusVirtualAccountDataDTO');

declare class CheckStatusVaResponseDTO {
  responseCode: string;
  responseMessage: string;
  virtualAccountData: CheckStatusVirtualAccountData;
  additionalInfo: CheckStatusResponseAdditionalInfo;
  constructor(data: unknown);
  toObject(): {
    responseCode: string;
    responseMessage: string;
    virtualAccountData: CheckStatusVirtualAccountData;
  };
}

export = CheckStatusVaResponseDTO;
