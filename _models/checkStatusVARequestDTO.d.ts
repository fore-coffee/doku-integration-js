declare class CheckStatusVARequestDto {
  partnerServiceId: string;
  customerNo: string;
  virtualAccountNo: string;
  inquiryRequestId?: string | null;
  paymentRequestId?: string | null;
  additionalInfo?: unknown;
  constructor(...args: Array<unknown>);
}

export = CheckStatusVARequestDto;
