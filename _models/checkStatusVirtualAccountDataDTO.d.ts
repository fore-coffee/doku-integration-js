import type CheckStatusResponsePaymentFlagReason = require('./checkStatusResponsePaymentFlagReasonDTO');
import type TotalAmount = require('./totalAmount');

declare class CheckStatusVirtualAccountData {
  paymentFlagReason: CheckStatusResponsePaymentFlagReason;
  partnerServiceId: string;
  customerNo: string;
  virtualAccountNo: string;
  inquiryRequestId?: string | null;
  paymentRequestId?: string | null;
  virtualAccountNumber?: string;
  paidAmount: TotalAmount;
  billDetails?: unknown;
  constructor(data: { paymentFlagReason: { english?: string; indonesia?: string }; [key: string]: unknown });
}

export = CheckStatusVirtualAccountData;
