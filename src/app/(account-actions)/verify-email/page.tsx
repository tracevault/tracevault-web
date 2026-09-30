import { AuthActionForm } from '@/components/forms/AuthActionForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
export default function Page() { return <Card className="w-full max-w-md"><CardHeader><CardTitle>이메일 주소 확인</CardTitle></CardHeader><CardContent><AuthActionForm purpose="verify" /></CardContent></Card>; }
