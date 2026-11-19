import { getTranslations } from 'next-intl/server';
import { segmentToothMentions } from '../text';

/**
 * Renders a stored note exactly as typed, but turns valid tooth mentions into
 * links to that tooth in the odontogram. Invalid numbers stay plain text.
 */
export default async function VisitNoteText({ text }: { text: string | null }) {
  const t = await getTranslations('clinical');
  if (!text?.trim()) return <p className="text-sm text-slate-400">{t('noVisitBody')}</p>;

  return (
    <p className="whitespace-pre-wrap text-sm text-slate-700">
      {segmentToothMentions(text).map((segment, index) =>
        segment.type === 'text' ? (
          <span key={index}>{segment.value}</span>
        ) : (
          <a
            key={index}
            href={`#tooth-${segment.toothNumber}`}
            className="font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-900"
            title={t('goToTooth', { tooth: segment.toothNumber })}
          >
            {segment.value}
          </a>
        ),
      )}
    </p>
  );
}
