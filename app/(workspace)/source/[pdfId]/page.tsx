import { SourcePageViewer } from "../../../../components/source-page-viewer";

export default async function SourcePage({
  params,
}: Readonly<{
  params: Promise<{ pdfId: string }>;
}>) {
  const { pdfId } = await params;
  return <SourcePageViewer pdfId={pdfId} />;
}
