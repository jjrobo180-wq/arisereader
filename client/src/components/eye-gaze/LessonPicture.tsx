// A lesson picture: a picture file, shown `count` times for counting, or an emoji from an older quiz.
import { isPictureFile } from "@/lib/eyeGazeLesson";

export default function LessonPicture({ src, alt, count = 1, className = "", emojiClassName = "text-[7rem] leading-none" }: {
  src: string | null | undefined;
  alt: string;
  count?: number;
  /** Size of one picture, e.g. "h-48 w-48". */
  className?: string;
  emojiClassName?: string;
}) {
  if (!src) return null;
  if (!isPictureFile(src)) return <span role="img" aria-label={alt} className={emojiClassName}>{src}</span>;
  if (count > 1) {
    return (
      <span role="img" aria-label={`${count} ${alt}`} className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {Array.from({ length: count }, (_, i) => (
          <img key={i} src={src} alt="" draggable={false} className={"object-contain select-none " + className} />
        ))}
      </span>
    );
  }
  return <img src={src} alt={alt} draggable={false} className={"object-contain select-none " + className} />;
}
