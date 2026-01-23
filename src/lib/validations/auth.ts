import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: '이메일을 입력해주세요' })
    .email({ message: '유효한 이메일을 입력해주세요' }),
  password: z
    .string()
    .min(1, { message: '비밀번호를 입력해주세요' })
    .min(8, { message: '비밀번호는 8자 이상이어야 합니다' }),
});

export const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, { message: '이메일을 입력해주세요' })
      .email({ message: '유효한 이메일을 입력해주세요' }),
    password: z
      .string()
      .min(1, { message: '비밀번호를 입력해주세요' })
      .min(8, { message: '비밀번호는 8자 이상이어야 합니다' })
      .regex(/[A-Z]/, { message: '대문자를 포함해야 합니다' })
      .regex(/[a-z]/, { message: '소문자를 포함해야 합니다' })
      .regex(/[0-9]/, { message: '숫자를 포함해야 합니다' }),
    confirmPassword: z
      .string()
      .min(1, { message: '비밀번호 확인을 입력해주세요' }),
    name: z
      .string()
      .min(1, { message: '이름을 입력해주세요' })
      .min(2, { message: '이름은 2자 이상이어야 합니다' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['confirmPassword'],
  });

export const profileSchema = z.object({
  name: z
    .string()
    .min(1, { message: '이름을 입력해주세요' })
    .min(2, { message: '이름은 2자 이상이어야 합니다' }),
  locale: z.enum(['ko-KR', 'ja-JP', 'en-US']).optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { message: '현재 비밀번호를 입력해주세요' }),
    newPassword: z
      .string()
      .min(1, { message: '새 비밀번호를 입력해주세요' })
      .min(8, { message: '비밀번호는 8자 이상이어야 합니다' })
      .regex(/[A-Z]/, { message: '대문자를 포함해야 합니다' })
      .regex(/[a-z]/, { message: '소문자를 포함해야 합니다' })
      .regex(/[0-9]/, { message: '숫자를 포함해야 합니다' }),
    confirmPassword: z
      .string()
      .min(1, { message: '새 비밀번호 확인을 입력해주세요' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['confirmPassword'],
  });

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ProfileFormData = z.infer<typeof profileSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
