import { Module } from "@nestjs/common";
import { AppConfigModule } from "../../common/config/app-config.module";
import { S3StorageService } from "./s3-storage.service";

@Module({
  imports: [AppConfigModule],
  providers: [S3StorageService],
  exports: [S3StorageService]
})
export class StorageModule {}
