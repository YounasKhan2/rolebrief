import { Module } from "@nestjs/common";
import { AppConfigModule } from "../../../common/config/app-config.module";
import { DocumentParserClientService } from "./document-parser-client.service";

@Module({
  imports: [AppConfigModule],
  providers: [DocumentParserClientService],
  exports: [DocumentParserClientService]
})
export class DocumentParserModule {}
