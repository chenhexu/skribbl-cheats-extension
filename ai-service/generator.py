"""Inference-only architecture from Caroline Chan's Informative Drawings.

Copyright (c) 2022 Caroline Chan. MIT; see LICENSE.informative-drawings.
Module names match upstream checkpoints. No torchvision/training imports.
"""
from torch import nn


class ResidualBlock(nn.Module):
    def __init__(self, features):
        super().__init__()
        self.conv_block = nn.Sequential(
            nn.ReflectionPad2d(1), nn.Conv2d(features, features, 3),
            nn.InstanceNorm2d(features), nn.ReLU(inplace=True),
            nn.ReflectionPad2d(1), nn.Conv2d(features, features, 3),
            nn.InstanceNorm2d(features),
        )

    def forward(self, image):
        return image + self.conv_block(image)


class Generator(nn.Module):
    def __init__(self, input_nc=3, output_nc=1, blocks=3):
        super().__init__()
        self.model0 = nn.Sequential(nn.ReflectionPad2d(3), nn.Conv2d(input_nc, 64, 7), nn.InstanceNorm2d(64), nn.ReLU(inplace=True))
        self.model1 = nn.Sequential(
            nn.Conv2d(64, 128, 3, stride=2, padding=1), nn.InstanceNorm2d(128), nn.ReLU(inplace=True),
            nn.Conv2d(128, 256, 3, stride=2, padding=1), nn.InstanceNorm2d(256), nn.ReLU(inplace=True),
        )
        self.model2 = nn.Sequential(*[ResidualBlock(256) for _ in range(blocks)])
        self.model3 = nn.Sequential(
            nn.ConvTranspose2d(256, 128, 3, stride=2, padding=1, output_padding=1), nn.InstanceNorm2d(128), nn.ReLU(inplace=True),
            nn.ConvTranspose2d(128, 64, 3, stride=2, padding=1, output_padding=1), nn.InstanceNorm2d(64), nn.ReLU(inplace=True),
        )
        self.model4 = nn.Sequential(nn.ReflectionPad2d(3), nn.Conv2d(64, output_nc, 7), nn.Sigmoid())

    def forward(self, image):
        for layer in (self.model0, self.model1, self.model2, self.model3, self.model4):
            image = layer(image)
        return image
