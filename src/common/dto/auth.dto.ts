import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from 'class-validator';

export class SigninDto {
  @IsDefined({ message: 'message.account.name.is-required' })
  @IsString({ message: 'message.account.username.must-is-string' })
  @MinLength(2, { message: 'message.account.username.min-length-is-2' })
  @MaxLength(32, { message: 'message.account.username.max-length-is-32' })
  username: string;

  @IsDefined({ message: 'message.account.name.is-required' })
  @IsString({ message: 'message.account.password.must-is-string' })
  @MinLength(6, { message: 'message.account.password.min-length-is-6' })
  @MaxLength(32, { message: 'message.account.password.max-length-is-32' })
  password: string;
}

export class SignupDto {
  @IsDefined({ message: 'message.account.name.is-required' })
  @IsString({ message: 'message.account.name.must-is-string' })
  @MinLength(2, { message: 'message.account.name.min-length-is-2' })
  @MaxLength(64, { message: 'message.account.name.max-length-is-64' })
  name: string;

  @IsDefined({ message: 'message.account.name.is-required' })
  @IsString({ message: 'message.account.username.must-is-string' })
  @MinLength(2, { message: 'message.account.username.min-length-is-2' })
  @MaxLength(32, { message: 'message.account.username.max-length-is-32' })
  username: string;

  @IsDefined({ message: 'message.account.name.is-required' })
  @IsString({ message: 'message.account.password.must-is-string' })
  @MinLength(6, { message: 'message.account.password.min-length-is-6' })
  @MaxLength(32, { message: 'message.account.password.max-length-is-32' })
  password: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'message.account.role.must-is-number' })
  roleId?: number;

  // optional fields
  @IsEmail({}, { message: 'message.account.email.wrong-format' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[0-9]{9,11}$/, {
    message: 'message.account.phone.invalid'
  })
  phone?: string;

  @MaxLength(64, { message: 'message.account.address.max-length-is-64' })
  @IsString()
  @IsOptional()
  address?: string;
}
