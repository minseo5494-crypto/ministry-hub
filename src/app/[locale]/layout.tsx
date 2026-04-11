import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import Footer from '@/components/Footer';
import FeedbackButtonWrapper from '@/components/FeedbackButtonWrapper';
import InAppBrowserAlert from '@/components/InAppBrowserAlert';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <main className="flex-grow">{children}</main>
      <Footer />
      <FeedbackButtonWrapper />
      <InAppBrowserAlert />
    </NextIntlClientProvider>
  );
}
