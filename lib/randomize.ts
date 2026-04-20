/**
 * Fisher-Yates shuffle algorithm
 * Генерирует случайный порядок индексов от 0 до length-1
 */
export function generateRandomOrder(length: number): number[] {
  const array = Array.from({ length }, (_, i) => i)
  
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    // Swap
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  
  return array
}
