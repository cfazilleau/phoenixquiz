import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mongoose and the Mongo driver must stay as runtime Node dependencies.
  serverExternalPackages: ['mongoose', 'mongodb', 'exceljs'],
  images: { unoptimized: true },
};

export default withNextIntl(nextConfig);
