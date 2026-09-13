export const prerender = false;

import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    let email = '';
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      email = typeof body.email === 'string' ? body.email.trim() : '';
    } else {
      const formData = await request.formData();
      const rawEmail = formData.get('email');
      email = typeof rawEmail === 'string' ? rawEmail.trim() : '';
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailPattern.test(email)) {
      if (!contentType.includes('application/json')) {
        const referer = request.headers.get('referer') || '/';
        const url = new URL(referer);
        url.searchParams.set('error', 'invalid-email');
        return Response.redirect(url.toString(), 303);
      }
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'A valid email address is required.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Progressive enhancement: redirect on form-urlencoded submissions
    if (!contentType.includes('application/json')) {
      const referer = request.headers.get('referer') || '/';
      const url = new URL(referer);
      url.searchParams.set('subscribed', 'true');
      return Response.redirect(url.toString(), 303);
    }

    // Foundational tier subscription capture (ready for DB or mailing service)
    return new Response(
      JSON.stringify({
        status: 'ok',
        message: 'Successfully subscribed to executive briefings.',
        email,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal subscription error';
    return new Response(
      JSON.stringify({
        status: 'error',
        message,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
