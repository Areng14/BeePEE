import cv2
import sys
import os

def cartoonify_image(image_path):
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Can't load image: {image_path}")

    # Smooth the colors
    color = img.copy()
    for _ in range(5):
        color = cv2.bilateralFilter(color, d=9, sigmaColor=90, sigmaSpace=90)

    # Soft edge-preserving filter
    smooth = cv2.edgePreservingFilter(color, flags=1, sigma_s=60, sigma_r=0.4)

    # Boost saturation and brightness
    hsv = cv2.cvtColor(smooth, cv2.COLOR_BGR2HSV)
    hsv[...,1] = cv2.subtract(hsv[...,1], 10)  # decrease saturation
    hsv[...,2] = cv2.add(hsv[...,2], 40)  # brightness
    cartoon = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

    # Overwrite original
    cv2.imwrite(image_path, cartoon)
    return True

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python cartoonify.py <image1> <image2> ...")
        sys.exit(1)
    
    image_paths = sys.argv[1:]
    total = len(image_paths)
    
    for i, image_path in enumerate(image_paths, 1):
        try:
            if os.path.exists(image_path):
                cartoonify_image(image_path)
                print(f"SUCCESS: {i}/{total} - {os.path.basename(image_path)}")
            else:
                print(f"ERROR: {i}/{total} - File not found: {image_path}")
        except Exception as e:
            print(f"ERROR: {i}/{total} - {image_path}: {str(e)}")
    
    print(f"Completed processing {total} images")