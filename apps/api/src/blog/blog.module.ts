import { Module } from '@nestjs/common';
import { BlogController } from './blog.controller.js';
@Module({ controllers: [BlogController] })
export class BlogModule {}
