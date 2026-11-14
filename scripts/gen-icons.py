"""Gera logo e ícones do PWA a partir de assets/logo-original.webp (requer Pillow).
Uso: python3 scripts/gen-icons.py"""
from PIL import Image

BG = (13, 13, 13, 255)
src = Image.open('assets/logo-original.webp').convert('RGBA')
logo = src.crop(src.getbbox())  # remove margens transparentes


def encaixar(img, lado, preenchimento, fundo=None):
    """Centraliza o logo num quadrado `lado`, ocupando `preenchimento` da altura."""
    tela = Image.new('RGBA', (lado, lado), fundo or (0, 0, 0, 0))
    alvo = int(lado * preenchimento)
    esc = min(alvo / img.height, alvo / img.width)
    r = img.resize((max(1, round(img.width * esc)), max(1, round(img.height * esc))), Image.LANCZOS)
    tela.paste(r, ((lado - r.width) // 2, (lado - r.height) // 2), r)
    return tela


h = 512
Image.open('assets/logo-original.webp')
logo.resize((round(logo.width * h / logo.height), h), Image.LANCZOS).save('public/logo.png', optimize=True)
encaixar(logo, 64, 0.94).save('public/favicon.png')
encaixar(logo, 192, 0.84, BG).save('public/pwa-192.png', optimize=True)
encaixar(logo, 512, 0.84, BG).save('public/pwa-512.png', optimize=True)
encaixar(logo, 512, 0.58, BG).save('public/pwa-maskable-512.png', optimize=True)  # zona segura de 80%
encaixar(logo, 180, 0.84, BG).save('public/apple-touch-icon.png', optimize=True)
