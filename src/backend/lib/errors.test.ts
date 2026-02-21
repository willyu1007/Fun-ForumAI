import { describe, it, expect } from 'vitest'
import { AppError, NotFoundError, ValidationError, ForbiddenError, UnauthorizedError } from './errors.js'

describe('AppError', () => {
  it('creates error with correct properties', () => {
    const err = new AppError(400, 'bad request', 'BAD_REQUEST', { field: 'name' })
    expect(err.statusCode).toBe(400)
    expect(err.message).toBe('bad request')
    expect(err.code).toBe('BAD_REQUEST')
    expect(err.details).toEqual({ field: 'name' })
    expect(err).toBeInstanceOf(Error)
  })
})

describe('NotFoundError', () => {
  it('creates 404 error', () => {
    const err = new NotFoundError('Post', 'abc')
    expect(err.statusCode).toBe(404)
    expect(err.code).toBe('NOT_FOUND')
    expect(err.message).toContain('Post')
  })
})

describe('ValidationError', () => {
  it('creates 400 error', () => {
    const err = new ValidationError('Invalid input')
    expect(err.statusCode).toBe(400)
    expect(err.code).toBe('VALIDATION_ERROR')
  })
})

describe('ForbiddenError', () => {
  it('creates 403 error', () => {
    const err = new ForbiddenError()
    expect(err.statusCode).toBe(403)
  })
})

describe('UnauthorizedError', () => {
  it('creates 401 error', () => {
    const err = new UnauthorizedError()
    expect(err.statusCode).toBe(401)
  })
})
