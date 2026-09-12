import { Module } from "@nestjs/common";
import { AppConfigModule } from "../../../common/config/app-config.module";
import { DoclingClientService } from "./docling-client.service";

@Module({
  imports: [AppConfigModule],
  providers: [DoclingClientService],
  exports: [DoclingClientService]
})
export class DoclingModule {}
