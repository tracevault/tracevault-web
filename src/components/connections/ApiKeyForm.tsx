'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getExchangeInfo } from '@/lib/exchanges';
import type { ExchangeType } from '@/types';

// Form validation schema
const apiKeyFormSchema = z.object({
  label: z.string().refine(value => [...value].length <= 80 && !/[\u0000-\u001f\u007f-\u009f]/u.test(value), '계정 이름은 제어 문자 없이 80자까지 입력하세요'),
  apiKey: z
    .string()
    .min(10, 'API Key는 최소 10자 이상이어야 합니다')
    .max(512, 'API Key가 너무 깁니다'),
  secretKey: z
    .string()
    .min(10, 'Secret Key는 최소 10자 이상이어야 합니다')
    .max(2048, 'Secret Key가 너무 깁니다'),
});

type ApiKeyFormData = z.infer<typeof apiKeyFormSchema>;

interface ApiKeyFormProps {
  exchange: ExchangeType;
  initialLabel?: string;
  reconnecting?: boolean;
  replacing?: boolean;
  onSubmit: (data: ApiKeyFormData) => Promise<void>;
  onTest?: (data: ApiKeyFormData) => Promise<{ success: boolean; message: string }>;
  isSubmitting?: boolean;
  isTesting?: boolean;
  error?: string | null;
  isCryptoReady?: boolean;
}

export function ApiKeyForm({
  exchange,
  initialLabel = '',
  reconnecting = false,
  replacing = false,
  onSubmit,
  onTest,
  isSubmitting = false,
  isTesting = false,
  error,
  isCryptoReady = true,
}: ApiKeyFormProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const exchangeInfo = getExchangeInfo(exchange);
  const credentialFields = exchangeInfo.credentialFields;

  const form = useForm<ApiKeyFormData>({
    resolver: zodResolver(apiKeyFormSchema),
    defaultValues: {
      label: initialLabel,
      apiKey: '',
      secretKey: '',
    },
  });

  const handleSubmit = async (data: ApiKeyFormData) => {
    setTestResult(null);
    await onSubmit(data);
  };

  const handleTest = async () => {
    const data = form.getValues();
    const apiKeyValid = await form.trigger('apiKey');
    const secretKeyValid = await form.trigger('secretKey');

    if (!apiKeyValid || !secretKeyValid || !onTest) return;

    setTestResult(null);
    const result = await onTest(data);
    setTestResult(result);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {/* Security notice */}
        <Alert variant={isCryptoReady ? 'default' : 'destructive'}>
          {isCryptoReady ? (
            <ShieldCheck className="h-4 w-4" />
          ) : (
            <ShieldAlert className="h-4 w-4" />
          )}
          <AlertDescription>
            {isCryptoReady
              ? 'API Key는 클라이언트에서 암호화되어 서버로 전송됩니다. 서버에서는 복호화하여 거래소와 통신합니다.'
              : '브라우저에서 암호화를 지원하지 않습니다. 보안 연결(HTTPS)을 사용하는지 확인하세요.'}
          </AlertDescription>
        </Alert>

        {!replacing && <FormField
          control={form.control}
          name="label"
          render={({ field }) => (
            <FormItem>
              <FormLabel>계정 이름 (선택)</FormLabel>
              <FormControl><Input placeholder="예: 장기 보관 계정" {...field} /></FormControl>
              <FormDescription>계정을 구분하기 위한 이름입니다.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />}

        {/* API Key */}
        <FormField
          control={form.control}
          name="apiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{credentialFields?.apiKeyLabel ?? 'API Key'}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder={credentialFields?.apiKeyPlaceholder ?? `${exchangeInfo.name} API Key를 입력하세요`}
                    autoComplete="off"
                    {...field}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowApiKey(!showApiKey)}
                    tabIndex={-1}
                  >
                    {showApiKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormDescription>
                {credentialFields?.apiKeyDescription ?? '거래소에서 발급받은 API Key를 입력하세요.'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Secret Key */}
        <FormField
          control={form.control}
          name="secretKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{credentialFields?.secretKeyLabel ?? 'Secret Key'}</FormLabel>
              <FormControl>
                <div className="relative">
                  {credentialFields?.secretMultiline ? (
                    <textarea
                      rows={7}
                      placeholder={credentialFields.secretKeyPlaceholder}
                      autoComplete="off"
                      spellCheck={false}
                      className={`border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 aria-invalid:border-destructive dark:bg-input/30 min-h-32 w-full resize-y rounded-md border bg-transparent px-3 py-2 pr-10 font-mono text-sm shadow-xs outline-none focus-visible:ring-[3px] ${showSecretKey ? '' : 'text-transparent caret-foreground selection:text-transparent'}`}
                      {...field}
                    />
                  ) : (
                    <Input
                      type={showSecretKey ? 'text' : 'password'}
                      placeholder={credentialFields?.secretKeyPlaceholder ?? `${exchangeInfo.name} Secret Key를 입력하세요`}
                      autoComplete="off"
                      {...field}
                    />
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                    tabIndex={-1}
                  >
                    {showSecretKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormDescription>
                {credentialFields?.secretKeyDescription ?? 'API Key와 함께 발급받은 Secret Key를 입력하세요.'}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Test result */}
        {testResult && (
          <Alert variant={testResult.success ? 'success' : 'destructive'}>
            <AlertDescription>{testResult.message}</AlertDescription>
          </Alert>
        )}

        {/* Error message */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          {onTest && (
            <Button
              type="button"
              variant="outline"
              onClick={handleTest}
              disabled={isTesting || isSubmitting || !isCryptoReady}
            >
              {isTesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              연결 테스트
            </Button>
          )}
          <Button
            type="submit"
            disabled={isSubmitting || isTesting || !isCryptoReady}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {replacing ? 'API 키 교체' : reconnecting ? '다시 연결' : '연결하기'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
