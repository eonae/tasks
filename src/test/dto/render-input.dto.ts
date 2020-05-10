import { IsString, IsNotEmpty, IsDefined, IsIn } from 'class-validator';

export class TestInput {

  @IsString()
  @IsNotEmpty()
  template: string;

  @IsDefined()
  data: any;

  @IsString()
  @IsIn(['xlsx', 'pdf'])
  format: string;
}
