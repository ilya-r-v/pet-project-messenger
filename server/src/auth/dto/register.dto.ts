import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'ivan@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Иван' })
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Иванов' })
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: 'qwerty123' })
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}