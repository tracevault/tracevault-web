import { AuthActionForm } from '@/components/forms/AuthActionForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
export default function Page() { return <Card className="w-full max-w-md"><CardHeader><CardTitle>비밀번호 재설정</CardTitle></CardHeader><CardContent><AuthActionForm purpose="reset" /></CardContent></Card>; }
