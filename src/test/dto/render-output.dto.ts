import { IsString, IsDefined } from 'class-validator';

export class TestOutput {

  @IsString()
  @IsDefined()
  fileUrl: string;
}