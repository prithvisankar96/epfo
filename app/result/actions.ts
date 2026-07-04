'use server';

import { redirect } from 'next/navigation';
import { destroySession } from '@/lib/session';

/** "Check another UAN" — wipe all session-held PF data immediately. */
export async function checkAnotherUan(): Promise<void> {
  destroySession();
  redirect('/check');
}
