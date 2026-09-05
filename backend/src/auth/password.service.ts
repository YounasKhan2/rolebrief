import { BadRequestException, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";

@Injectable()
export class PasswordService {
  validatePolicy(password: string) {
    const byteLength = Buffer.byteLength(password, "utf8");
    if (password.length < 12) {
      throw new BadRequestException("Password must be at least 12 characters.");
    }
    if (byteLength > 1024) {
      throw new BadRequestException("Password is too long.");
    }
  }

  hash(password: string) {
    this.validatePolicy(password);
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1
    });
  }

  verify(hash: string, password: string) {
    return argon2.verify(hash, password);
  }
}
