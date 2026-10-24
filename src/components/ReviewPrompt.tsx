import { Button, Card } from './ui'
import { markRated, requestNativeReview } from '../platform/review'

export default function ReviewPrompt({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="rate-title">
      <Card className="w-full max-w-sm p-5">
        <h2 id="rate-title" className="text-lg font-bold text-cream">Enjoying Social Dart?</h2>
        <p className="mt-2 text-cream/75">
          Social Dart is free and we want to keep it that way. If you have a moment, please rate us.
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Not now
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => {
              markRated()
              onClose()
              void requestNativeReview()
            }}
          >
            Rate
          </Button>
        </div>
      </Card>
    </div>
  )
}
