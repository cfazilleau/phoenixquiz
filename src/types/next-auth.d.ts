import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth/jwt' {
  interface JWT {
    /** PhoenixQuiz User _id */
    uid?: string;
  }
}
