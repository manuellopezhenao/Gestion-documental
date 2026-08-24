import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto): Promise<{ accessToken: string }> {
    return this.authService.login(dto.email, dto.password);
  }

  // Con JWT stateless y un solo usuario en su propia PC no hace falta
  // blacklist de tokens (ver PLAN_API.md seccion 7.5): el cliente
  // simplemente descarta el token. Se deja el endpoint por completitud del
  // contrato de la API.
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(): { ok: boolean } {
    return { ok: true };
  }
}
