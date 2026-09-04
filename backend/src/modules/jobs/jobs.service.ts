import { Injectable } from "@nestjs/common";

@Injectable()
export class JobsService {
  list() {
    return {
      data: [],
      pageInfo: { nextCursor: null },
      freshness: { servedFromStoredData: true }
    };
  }
}
