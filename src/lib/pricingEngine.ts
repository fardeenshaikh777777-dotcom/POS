import type { Deal, MenuItem, OrderType } from '@/types/domain'

export interface CartItemLike {
  menuItem: MenuItem
  quantity: number
  notes?: string | null
}

export interface EligibilityResult {
  isEligible: boolean
  reason?: string
}

export interface PricingCalculationResult {
  deal: Deal
  isEligible: boolean
  ineligibilityReason?: string
  eligibleSubtotal: number
  dealDiscount: number
  finalSubtotal: number
  summary: string
}

/**
 * Check whether a deal is currently eligible for an order based on time, weekday, order type, and minimum order.
 */
export function checkDealEligibility(
  deal: Deal,
  context: {
    orderType: OrderType
    subtotal: number
    cart: CartItemLike[]
    currentTime?: Date
  }
): EligibilityResult {
  if (!deal.is_active) {
    return { isEligible: false, reason: 'Deal is currently deactivated.' }
  }

  const now = context.currentTime || new Date()

  // 1. Check Date & Time Window (in Asia/Karachi time)
  if (deal.start_time && new Date(deal.start_time) > now) {
    return { isEligible: false, reason: 'Deal has not started yet.' }
  }

  if (deal.end_time && new Date(deal.end_time) < now) {
    return { isEligible: false, reason: 'Deal has expired.' }
  }

  // 2. Check Weekday (0 = Sunday, 1 = Monday ... 6 = Saturday)
  const currentWeekday = now.getDay()
  if (
    deal.applicable_weekdays &&
    deal.applicable_weekdays.length > 0 &&
    !deal.applicable_weekdays.includes(currentWeekday)
  ) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const allowedDays = deal.applicable_weekdays.map((d) => dayNames[d]).join(', ')
    return { isEligible: false, reason: `Valid only on: ${allowedDays}.` }
  }

  // 3. Check Order Type
  if (
    deal.applicable_order_types &&
    deal.applicable_order_types.length > 0 &&
    !deal.applicable_order_types.includes(context.orderType)
  ) {
    return { isEligible: false, reason: `Valid only for: ${deal.applicable_order_types.join(', ')}.` }
  }

  // 4. Check Redemption Limit
  if (deal.redemption_limit && deal.times_redeemed >= deal.redemption_limit) {
    return { isEligible: false, reason: 'Maximum promotion redemption limit reached.' }
  }

  // 5. Check Minimum Order Amount
  if (deal.min_order_amount && context.subtotal < deal.min_order_amount) {
    return {
      isEligible: false,
      reason: `Minimum order of Rs. ${deal.min_order_amount.toLocaleString()} required.`,
    }
  }

  // 6. Check Specific Item / Combo Requirements
  if (deal.deal_type === 'combo') {
    const requiredItems = deal.items || []
    for (const req of requiredItems) {
      if (req.menu_item_id) {
        const found = context.cart.find((ci) => ci.menuItem.id === req.menu_item_id)
        if (!found || found.quantity < (req.required_quantity || 1)) {
          const reqName = req.menu_item?.name || 'Required combo item'
          return {
            isEligible: false,
            reason: `Cart missing required combo item: ${reqName} (qty: ${req.required_quantity || 1}).`,
          }
        }
      } else if (req.category_id) {
        const totalInCat = context.cart
          .filter((ci) => ci.menuItem.category_id === req.category_id)
          .reduce((sum, ci) => sum + ci.quantity, 0)
        if (totalInCat < (req.required_quantity || 1)) {
          return {
            isEligible: false,
            reason: `Cart requires at least ${req.required_quantity || 1} item(s) from category.`,
          }
        }
      }
    }
  }

  if (deal.deal_type === 'bogo') {
    const eligibleItemIds = (deal.items || [])
      .filter((i) => i.menu_item_id)
      .map((i) => i.menu_item_id!)

    const eligibleItems = context.cart.filter(
      (ci) => eligibleItemIds.length === 0 || eligibleItemIds.includes(ci.menuItem.id)
    )

    const totalEligibleQty = eligibleItems.reduce((acc, ci) => acc + ci.quantity, 0)
    if (totalEligibleQty < 2) {
      return {
        isEligible: false,
        reason: 'Buy 1 Get 1 Free requires at least 2 qualifying items in cart.',
      }
    }
  }

  if (deal.deal_type === 'item_discount') {
    const eligibleItemIds = (deal.items || [])
      .filter((i) => i.menu_item_id)
      .map((i) => i.menu_item_id!)
    const hasItem = context.cart.some((ci) => eligibleItemIds.includes(ci.menuItem.id))
    if (!hasItem) {
      return {
        isEligible: false,
        reason: 'Cart does not contain the promotional item for this deal.',
      }
    }
  }

  return { isEligible: true }
}

/**
 * Calculate the exact, authoritative discount amount for a given deal applied to a cart.
 */
export function calculateDealDiscount(
  deal: Deal,
  cart: CartItemLike[],
  orderType: OrderType,
  currentTime?: Date
): PricingCalculationResult {
  const subtotal = cart.reduce((acc, ci) => acc + ci.menuItem.price * ci.quantity, 0)
  const eligibility = checkDealEligibility(deal, { orderType, subtotal, cart, currentTime })

  if (!eligibility.isEligible) {
    return {
      deal,
      isEligible: false,
      ineligibilityReason: eligibility.reason,
      eligibleSubtotal: 0,
      dealDiscount: 0,
      finalSubtotal: subtotal,
      summary: eligibility.reason || 'Not eligible',
    }
  }

  let discount = 0
  let eligibleSubtotal = subtotal

  switch (deal.deal_type) {
    case 'combo': {
      // Combo Deal: Fixed combo price replaces individual item prices
      const comboPrice = deal.combo_price ?? deal.discount_value
      const requiredItems = deal.items || []

      // Calculate the original regular price of 1 set of the required combo items
      let comboOriginalPrice = 0
      for (const req of requiredItems) {
        if (req.menu_item_id) {
          const item = cart.find((ci) => ci.menuItem.id === req.menu_item_id)?.menuItem
          if (item) {
            comboOriginalPrice += item.price * (req.required_quantity || 1)
          }
        }
      }

      eligibleSubtotal = comboOriginalPrice > 0 ? comboOriginalPrice : subtotal
      // Discount is the savings between regular price and configured combo price
      discount = Math.max(0, eligibleSubtotal - comboPrice)
      break
    }

    case 'percentage_discount': {
      // Percentage discount: e.g. 15% off
      const pct = Math.min(100, Math.max(0, deal.discount_value))

      // Check if restricted to specific items
      const specificItemIds = (deal.items || [])
        .filter((i) => i.menu_item_id)
        .map((i) => i.menu_item_id!)

      if (specificItemIds.length > 0) {
        eligibleSubtotal = cart
          .filter((ci) => specificItemIds.includes(ci.menuItem.id))
          .reduce((sum, ci) => sum + ci.menuItem.price * ci.quantity, 0)
      } else {
        eligibleSubtotal = subtotal
      }

      discount = Math.round((eligibleSubtotal * pct) / 100)
      break
    }

    case 'flat_discount': {
      // Flat Rs. X off
      eligibleSubtotal = subtotal
      discount = Math.min(deal.discount_value, subtotal)
      break
    }

    case 'bogo': {
      // Buy 1 Get 1 Free: For every 2 qualifying items, 1 of the lowest priced items is free
      const eligibleItemIds = (deal.items || [])
        .filter((i) => i.menu_item_id)
        .map((i) => i.menu_item_id!)

      // Flatten items array to find price of free items
      const qualifyingUnitPrices: number[] = []
      cart.forEach((ci) => {
        if (eligibleItemIds.length === 0 || eligibleItemIds.includes(ci.menuItem.id)) {
          for (let i = 0; i < ci.quantity; i++) {
            qualifyingUnitPrices.push(ci.menuItem.price)
          }
        }
      })

      // Sort ascending to give free item as the lowest priced item
      qualifyingUnitPrices.sort((a, b) => a - b)
      const freeItemCount = Math.floor(qualifyingUnitPrices.length / 2)
      discount = qualifyingUnitPrices.slice(0, freeItemCount).reduce((sum, p) => sum + p, 0)
      eligibleSubtotal = qualifyingUnitPrices.reduce((sum, p) => sum + p, 0)
      break
    }

    case 'item_discount': {
      // Fixed or percentage off specific items
      const eligibleItemIds = (deal.items || [])
        .filter((i) => i.menu_item_id)
        .map((i) => i.menu_item_id!)

      const matchingCartItems = cart.filter((ci) => eligibleItemIds.includes(ci.menuItem.id))
      eligibleSubtotal = matchingCartItems.reduce((sum, ci) => sum + ci.menuItem.price * ci.quantity, 0)

      if (deal.discount_type === 'percentage') {
        const pct = Math.min(100, Math.max(0, deal.discount_value))
        discount = Math.round((eligibleSubtotal * pct) / 100)
      } else {
        // Fixed amount off
        const totalQty = matchingCartItems.reduce((sum, ci) => sum + ci.quantity, 0)
        discount = Math.min(eligibleSubtotal, deal.discount_value * totalQty)
      }
      break
    }
  }

  // Apply max discount ceiling if specified
  if (deal.max_discount_amount && deal.max_discount_amount > 0) {
    discount = Math.min(discount, deal.max_discount_amount)
  }

  // Guard against negative discounts or exceeding subtotal
  discount = Math.max(0, Math.min(discount, subtotal))

  return {
    deal,
    isEligible: true,
    eligibleSubtotal,
    dealDiscount: discount,
    finalSubtotal: subtotal - discount,
    summary: `${deal.name} applied: Rs. ${discount.toLocaleString()} savings`,
  }
}
