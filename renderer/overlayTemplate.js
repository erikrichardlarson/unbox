export const htmlTemplate = (scriptTag, styleTag, htmlString) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="tailwind.css">
  <title>Unbox Overlay</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"></script>
  ${scriptTag}
  ${styleTag}
</head>
<body>
  ${htmlString}
</body>
</html>
`;
