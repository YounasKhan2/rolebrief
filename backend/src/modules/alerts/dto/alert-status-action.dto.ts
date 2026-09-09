import { IsInt, Min } from 'class-validator';

export class AlertStatusActionDto {
  @IsInt()
  @Min(0)
  expectedRevision!: number;
}
