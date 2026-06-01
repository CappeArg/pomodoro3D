/**
 * 3D Tilt Effect (Parallax Hover)
 * Calculates the cursor position over elements and applies a real-time 3D rotation transform.
 */
export class TiltEffect {
  private maxRotateDegrees: number = 10; // Max tilt rotation angle

  constructor() {
    this.init();
  }

  public init(): void {
    const cards = document.querySelectorAll('.tilt-card');
    cards.forEach((card) => {
      const element = card as HTMLElement;

      // Mouse move listener
      element.addEventListener('mousemove', (e) => this.handleMouseMove(e, element));

      // Mouse leave listener (resets tilt)
      element.addEventListener('mouseleave', () => this.handleMouseLeave(element));
    });
  }

  private handleMouseMove(e: MouseEvent, element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left; // x position within the element.
    const y = e.clientY - rect.top;  // y position within the element.

    // Calculate percentages for CSS reflection light source
    const percentX = (x / rect.width) * 100;
    const percentY = (y / rect.height) * 100;

    element.style.setProperty('--mouse-x', `${percentX}%`);
    element.style.setProperty('--mouse-y', `${percentY}%`);

    // Calculate rotation angles based on cursor distance from center
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Normalized distance from center (range -1 to 1)
    const rotateY = ((x - centerX) / centerX) * this.maxRotateDegrees;
    const rotateX = -((y - centerY) / centerY) * this.maxRotateDegrees; // Invert to rotate towards cursor

    // Apply 3D transform
    element.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  }

  private handleMouseLeave(element: HTMLElement): void {
    // Reset rotations smoothly
    element.style.transform = 'rotateX(0deg) rotateY(0deg)';
    
    // Transition back smoothly, then remove the transition so hover is instant again
    element.style.transition = 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1), border-color 0.4s ease';
    
    setTimeout(() => {
      // Remove temporary transform transition to avoid stuttering on mouse enter
      element.style.transition = 'transform 0.15s cubic-bezier(0.25, 1, 0.5, 1), border-color 0.4s ease';
    }, 500);
  }
}
export const tilt = new TiltEffect();
export default tilt;
