import {Injectable, NestInterceptor, ExecutionContext, CallHandler} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RESPONSE_MESSAGE_KEY } from '../decorators/response-message.decorator';

export interface Response<T> {
  Error: number;
  Message: string;
  Data: T;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  constructor(private reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    // Ambil pesan custom dari Decorator
    const customMessage = this.reflector.get<string>(
      RESPONSE_MESSAGE_KEY,
      context.getHandler(),
    );

    // Bungkus data
    return next.handle().pipe(
      map((data) => ({
        Error: 0, 
        Message: customMessage || 'Success', 
        Data: data, 
      })),
    );
  }
}
