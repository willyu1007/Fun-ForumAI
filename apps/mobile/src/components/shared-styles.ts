import { StyleSheet } from 'react-native'
import { colors, radius, spacing, typography } from '@fun-forum/ui-mobile/theme'

export const shared = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing[3],
  },
  cardTitle: {
    fontSize: typography.size.bodyLg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionTitle: {
    marginTop: spacing[2],
    fontSize: typography.size.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing[3],
    flexWrap: 'wrap',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[4],
    paddingVertical: 9,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.onPrimary,
    fontWeight: '600',
    fontSize: typography.size.body,
  },
  secondaryButton: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing[4],
    paddingVertical: 9,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
  },
  listRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: spacing[2],
  },
  listRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  itemText: {
    color: colors.textPrimary,
    fontSize: typography.size.body,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: typography.size.caption,
    marginTop: spacing[1],
  },
  detailBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: 10,
    gap: spacing[2],
  },
  messageRow: {
    marginTop: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingBottom: 6,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: typography.size.caption,
    fontStyle: 'italic',
    marginTop: spacing[2],
  },
  disabled: {
    opacity: 0.5,
  },
})
