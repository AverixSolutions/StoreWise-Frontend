import type { BatchInfo, HeaderForm, ItemRow } from "@/components/sales/types";
import type { SaleReturnSourceItem, SaleRow } from "@/platform/types";

export type SalesReturnMode = "MANUAL" | "SOURCE";

export type SalesReturnHeader = HeaderForm & {
  sourceSaleId?: string | null;
};

export type SalesReturnItemRow = ItemRow & {
  sourceSaleItemId?: string | null;
  sourceBatchNo?: string | null;
  sourceRate?: number | null;
  sourceRateTypeId?: string | null;
  sourceRateTypeCode?: string | null;
  sourceRateTypeName?: string | null;
  soldQuantity?: number;
  previouslyReturnedQuantity?: number;
  remainingReturnableQuantity?: number;
};

export type SourceSaleOption = SaleRow;
export type SourceSaleLine = SaleReturnSourceItem;
export type SalesReturnBatchInfo = BatchInfo;
