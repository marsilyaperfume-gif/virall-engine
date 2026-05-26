v36 Cloudinary Hooked Video:
- Uploads the original video to Cloudinary.
- Builds a Cloudinary transformed video URL with the hook burned over the video.
- Saves the transformed URL as the main cloudinaryUrl used by publish and schedule.
- Keeps Meta OAuth, publishing functions, smart scheduler, and layout unchanged.
- More stable than browser canvas rendering and preserves original video/audio because Cloudinary handles the transformation.
