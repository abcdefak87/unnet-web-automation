import React, { useState } from 'react';
import { Star, X, Send, ThumbsUp, ThumbsDown } from 'lucide-react';
import { api } from '../lib/api';

interface CustomerRatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  technicianName: string;
  jobNumber: string;
  onRatingSubmitted?: (rating: number) => void;
}

export default function CustomerRatingModal({
  isOpen,
  onClose,
  jobId,
  technicianName,
  jobNumber,
  onRatingSubmitted
}: CustomerRatingModalProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;

    setIsSubmitting(true);
    try {
      await api.post('/jobs/rating', {
        jobId,
        rating,
        feedback: feedback.trim() || null,
        customerSatisfaction: rating >= 4 ? 5 : rating >= 3 ? 4 : rating
      });

      setSubmitted(true);
      onRatingSubmitted?.(rating);
      
      setTimeout(() => {
        onClose();
        resetForm();
      }, 2000);
    } catch (error) {
      console.error('Error submitting rating:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setRating(0);
    setHoveredRating(0);
    setFeedback('');
    setSubmitted(false);
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  if (!isOpen) return null;

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md mx-4 text-center">
          <div className="text-green-500 text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Terima Kasih!</h2>
          <p className="text-gray-600 mb-4">
            Rating Anda telah berhasil dikirim. 
            Feedback Anda sangat membantu kami meningkatkan layanan.
          </p>
          <div className="flex justify-center space-x-1 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`w-6 h-6 ${
                  i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Rating Layanan</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-gray-600 mb-2">
            Bagaimana pengalaman Anda dengan layanan kami?
          </p>
          <p className="text-sm text-gray-500">
            Job: <span className="font-medium">{jobNumber}</span>
          </p>
          <p className="text-sm text-gray-500">
            Teknisi: <span className="font-medium">{technicianName}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Star Rating */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Berikan rating (1-5 bintang):
            </label>
            <div className="flex justify-center space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-10 h-10 ${
                      star <= (hoveredRating || rating)
                        ? 'text-yellow-400 fill-current'
                        : 'text-gray-300 hover:text-yellow-200'
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="text-center mt-2">
              <span className="text-sm text-gray-600">
                {rating === 0 && 'Pilih rating'}
                {rating === 1 && 'Sangat Buruk'}
                {rating === 2 && 'Buruk'}
                {rating === 3 && 'Biasa'}
                {rating === 4 && 'Baik'}
                {rating === 5 && 'Sangat Baik'}
              </span>
            </div>
          </div>

          {/* Feedback */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Feedback (opsional):
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Bagikan pengalaman Anda..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              maxLength={500}
            />
            <div className="text-right text-xs text-gray-500 mt-1">
              {feedback.length}/500 karakter
            </div>
          </div>

          {/* Quick Feedback */}
          {rating > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Aspek yang perlu diperbaiki:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Kecepatan layanan',
                  'Komunikasi teknisi',
                  'Kualitas pekerjaan',
                  'Kerapihan hasil'
                ].map((aspect) => (
                  <label key={aspect} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{aspect}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={rating === 0 || isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Mengirim...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Kirim Rating</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
