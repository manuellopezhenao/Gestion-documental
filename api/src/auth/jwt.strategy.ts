import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../config/configuration';
import { JwtPayload, UsuarioAutenticado } from './types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const appConfig = config.get<AppConfig>('app')!;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: appConfig.jwtSecret,
    });
  }

  validate(payload: JwtPayload): UsuarioAutenticado {
    return { id: payload.sub, email: payload.email, rol: payload.rol };
  }
}
