import { Injectable } from "@nestjs/common";
import { BATCH_WRITE_SIZE } from "../../shared/pagination.util";

@Injectable()
export class BatchProcessorService {
  readonly batchSize = BATCH_WRITE_SIZE;

  *batch<T>(items: T[], size = this.batchSize): Generator<T[]> {
    for (let i = 0; i < items.length; i += size) {
      yield items.slice(i, i + size);
    }
  }
}
